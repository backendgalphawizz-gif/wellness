exports.getHealth = (req, res) => {
  res.json({
    status: true,
    message: "Health check",
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};
