const ErrorMiddleware = (err, req, res, next) => {
    // Default to 500 if statusCode is undefined or not a valid number
    let statusCode = res.statusCode;
    
    if (!statusCode || typeof statusCode !== 'number' || statusCode < 100 || statusCode > 599) {
        statusCode = 500;
    }
    
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = ErrorMiddleware;