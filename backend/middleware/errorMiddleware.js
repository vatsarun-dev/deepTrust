function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
}

function errorHandler(error, req, res, next) {
  const uploadError = error?.name === "MulterError";
  const statusCode = uploadError && error?.code === "LIMIT_FILE_SIZE"
    ? 413
    : res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500;

  res.status(statusCode).json({
    success: false,
    message: uploadError && error?.code === "LIMIT_FILE_SIZE"
      ? "The uploaded media exceeds the 100 MB analysis limit."
      : error.message || "Something went wrong",
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  });
}

module.exports = {
  notFound,
  errorHandler,
};
