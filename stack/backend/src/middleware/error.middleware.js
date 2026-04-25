export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
}

export function errorHandler(error, req, res, next) {
  void next;

  const statusCode = error.statusCode || error.status || 500;
  const message = error.expose ? error.message : (error.message || 'Internal server error');

  res.status(statusCode).json({
    success: false,
    error: {
      message
    }
  });
}
