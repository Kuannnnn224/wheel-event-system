'use strict';

function notFound(req, res) {
  res.status(404).json({
    message: 'Route not found.',
    path: req.path
  });
}

module.exports = notFound;
