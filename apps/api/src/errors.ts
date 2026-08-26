import { HTTPException } from "hono/http-exception";

export interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

/** Throw this for expected failures that should reach the client verbatim. */
export function httpError(
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503,
  code: string,
  message: string,
): HTTPException {
  return new HTTPException(status, {
    res: Response.json(errorBody(code, message), { status }),
  });
}
