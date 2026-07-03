"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get("/", (_req, res) => {
    res.json({
        port: process.env.PORT || "3000",
        enableGeocoder: process.env.ENABLE_GEOCODER === "true",
        enableReadings: process.env.ENABLE_READINGS === "true",
        geocoder: {
            cron: process.env.GEOCODER_CRON || "0 3 */3 * *",
            batchSizeShedule: parseInt(process.env.GEOCODER_BATCH_SIZE || "300", 10),
            batchSizeHandle: parseInt(process.env.GEOCODING_BATCH_SIZE || "3000", 10),
            retryDays: parseInt(process.env.GEOCODER_RETRY_DAYS || "30", 10),
        },
        readings: {
            cron: process.env.READINGS_CRON || "0 2 */3 * *",
            batchSize: parseInt(process.env.READINGS_BATCH_SIZE || "1000", 10),
        },
    });
});
exports.default = router;
//# sourceMappingURL=reference.js.map