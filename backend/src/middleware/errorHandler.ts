import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
    }
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const message = err instanceof Error ? err.message : 'Internal Server Error';

    res.status(statusCode).json({ error: message });
}
