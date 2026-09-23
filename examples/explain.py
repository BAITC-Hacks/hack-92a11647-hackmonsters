"""Run from the repository root: python -m examples.explain result.json."""

import asyncio
import json
from pathlib import Path
import sys

from dotenv import load_dotenv

from llm_integration import AssessmentUnavailable, LLMRouter


async def main():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
    if len(sys.argv) not in (2, 3, 4):
        raise SystemExit("Usage: python -m examples.explain result.json [openai|nvidia] [fallback|none]")
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    provider = sys.argv[2] if len(sys.argv) > 2 else "openai"
    fallback = sys.argv[3] if len(sys.argv) > 3 else None
    if fallback == "none":
        fallback = None
    try:
        async with LLMRouter.from_env() as router:
            result = await router.assess(data, provider=provider, fallback=fallback)
    except AssessmentUnavailable as exc:
        raise SystemExit(str(exc)) from None
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
