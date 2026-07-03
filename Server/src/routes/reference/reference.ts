import { Router, Request, Response } from "express";
import { getSettings } from "../../services/configService";

const router = Router();
router.get("/", async (_req: Request, res: Response) => {
  try {
    const s = await getSettings();
    res.json({
      port: process.env.PORT || "3000",
      enableGeocoder: s.enableGeocoder,
      enableReadings: s.enableReadings,
      geocoder: {
        cron: s.geocoderCron,
        batchSizeShedule: s.geocoderBatchSize,
        batchSizeHandle: s.geocodingBatchSize,
        retryDays: s.geocoderRetryDays,
      },
      readings: {
        cron: s.readingsCron,
        batchSize: s.readingsBatchSize,
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
