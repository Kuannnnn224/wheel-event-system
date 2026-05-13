'use strict';

/**
 * 回傳統一的 404 JSON，放在所有 routes 之後處理未命中路由。
 *
 * @param {{ path: string }} req
 * @param {Object} res
 * @returns {void}
 */
function notFound(req, res) {
  res.status(404).json({
    message: 'Route not found.',
    path: req.path
  });
}

module.exports = notFound;
