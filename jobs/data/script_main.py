"""Shared entry point for the job scripts: turns errors into clear logs and exit codes."""

from __future__ import annotations

from typing import Callable

from api_client import ApiError, ConfigError
from joblog import log
from retry import DeadlineExceeded
from schema_check import SchemaValidationError
from source_common import ProviderIntegrationError

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_CONFIG = 2


def run(step: str, main: Callable[[], int]) -> int:
    try:
        return main()
    except ConfigError as error:
        log("ERROR", "Configuration error", step=step, error_message=str(error))
        return EXIT_CONFIG
    except ApiError as error:
        log("ERROR", "API call failed", step=step, route=error.route, status=error.status, error_code=error.error_code)
        return EXIT_FAILED
    except DeadlineExceeded:
        log("ERROR", "Step time budget used up", step=step)
        return EXIT_FAILED
    except ProviderIntegrationError as error:
        log("ERROR", "Data source failed", step=step, provider=error.provider, error_code=error.error_code)
        return EXIT_FAILED
    except SchemaValidationError as error:
        log("ERROR", "Payload failed schema validation", step=step, error_message=str(error)[:300])
        return EXIT_FAILED
    except Exception as error:  # last-resort: name the type only, never dump locals
        log("ERROR", "Unexpected error", step=step, error_type=type(error).__name__)
        return EXIT_FAILED
