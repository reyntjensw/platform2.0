"""Async deploy task — parse IR, generate code, run tofu apply, callback."""

from __future__ import annotations
import tempfile
import logging
from workers.celery_app import app
from core.ir_parser import parse_ir
from generators.opentofu.generator import generate
from engines.opentofu import init, plan, apply
from utils.netrc import inject_netrc
from utils.callback import send_callback

logger = logging.getLogger(__name__)


@app.task(name="workers.deploy_task.run_deploy", bind=True)
def run_deploy(self, ir_data: dict):
    """Execute a deploy job: generate .tf → init → plan → apply → callback."""
    ir = parse_ir(ir_data)
    callback_url = ir.callback_url

    try:
        send_callback(callback_url, {"status": "applying"})

        with tempfile.TemporaryDirectory(prefix="f50-deploy-") as workspace:
            generate(ir, workspace)

            git_creds = [{"host": g.host, "token": g.token} for g in ir.git_credentials]
            with inject_netrc(git_creds):
                ok, init_output = init(workspace)
                if not ok:
                    send_callback(callback_url, {"status": "failed", "plan_output": init_output})
                    return {"status": "failed", "error": "init failed"}

                ok, plan_output = plan(workspace)
                if not ok:
                    send_callback(callback_url, {"status": "failed", "plan_output": plan_output})
                    return {"status": "failed", "error": "plan failed"}

                ok, apply_output = apply(workspace)

            status = "completed" if ok else "failed"
            send_callback(callback_url, {
                "status": status,
                "plan_output": apply_output,
                "result": {"applied": ok},
            })
            return {"status": status}

    except Exception as e:
        logger.exception("Deploy task failed")
        send_callback(callback_url, {"status": "failed", "plan_output": str(e)})
        return {"status": "failed", "error": str(e)}
