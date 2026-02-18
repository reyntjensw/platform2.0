FROM python:3.12-slim

# Install OpenTofu
RUN apt-get update && apt-get install -y curl gnupg unzip git && \
    curl -fsSL https://get.opentofu.org/install-opentofu.sh | sh -s -- --install-method deb && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
