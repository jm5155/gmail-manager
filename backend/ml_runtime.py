"""Optional local ML model runtime. Shadow-only until an active model is trained."""

import asyncio
import io
import joblib


class MLModelRuntime:
    def __init__(self):
        self.model = None
        self.version = None

    def load(self, blob: bytes, version: str = None):
        self.model = joblib.load(io.BytesIO(blob))
        self.version = version

    async def predict(self, features: dict):
        if self.model is None:
            return None
        return await asyncio.to_thread(self.model.predict_proba, [features])


ml_runtime = MLModelRuntime()
