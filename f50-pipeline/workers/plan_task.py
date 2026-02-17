"""Async plan task — parse IR, generate code, run tofu plan, callback."""

from __future__ import annotations
import tempfile
import logging
from workers.celery_app import app
from core.ir_parser import parse_ir
from generators.opentofu.generator import generate
from engines.opentofu import init, plan, show_plan
from utils.netrc import inject_netrc
from utils.callback import send_callback

logger = logging.getLogger(__name__)


@app.task(name="workers.plan_task.run_plan", bind=True)
def run_plan(self, ir_data: dict):
    """Execute a plan job: generate .tf → tofu init → tofu plan → callback."""
    ir = parse_ir(ir_data)
    callback_url = ir.callback_url

    try:
        # Notify Rails we're planning
        send_callback(callback_url, {"status": "planning"})

        with tempfile.TemporaryDirectory(prefix="f50-plan-") as workspace:
            # Generate .tf files
            generate(ir, workspace)

            # Inject git credentials
            git_creds = [{"host": g.host, "token": g.token} for g in ir.git_credentials]
            with inject_netrc(git_creds):
                # Init
                ok, init_output = init(workspace)
                if not ok:
                    send_callback(callback_url, {"status": "failed", "plan_output": init_output})
                    return {"status": "failed", "error": "init failed"}

                # Plan
                ok, plan_output = plan(workspace)
                if not ok:
                    send_callback(callback_url, {"status": "failed", "plan_output": plan_output})
                    return {"status": "failed", "error": "plan failed"}

                # Show plan
                _, show_output = show_plan(workspace)

            send_callback(callback_url, {
                "status": "planned",
                "plan_output": show_output or plan_output,
            })
            return {"status": "planned"}

    except Exception as e:
        logger.exception("Plan task failed")
        send_callback(callback_url, {"status": "failed", "plan_output": str(e)})
        return {"status": "failed", "error": str(e)}
