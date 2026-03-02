const runWithLogging = async (actionName, fn, logger = console) => {
    try {
        return await fn();
    } catch (error) {
        logger.error(`[${actionName}] failed: ${error.message}`);
        throw error;
    }
};

module.exports = { runWithLogging };
