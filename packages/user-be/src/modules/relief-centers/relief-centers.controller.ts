import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware";
import { validateBody, validateQuery } from "../../common/middleware/validate.middleware";
import { nearbyCentersQuerySchema, createReliefCenterSchema, updateReliefCenterSchema } from "./relief-centers.schema";
import { addReliefCenter, getNearbyCenters, getCenterDetails, updateCenterStatus, fetchAndSaveReliefCenters } from "./relief-centers.service";
import { redisClient } from "../../common/db/redis";

const router = Router();

router.get("/nearby", validateQuery(nearbyCentersQuerySchema), async (req, res) => {
  const { latitude, longitude, radiusMeters } = req.query as any;
  const centers = await getNearbyCenters(latitude, longitude, radiusMeters);
  res.json({ success: true, data: centers });
});

router.post("/fetch-automated", async (req, res, next) => {
  try {
    const { latitude, longitude, radiusMeters } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: "latitude and longitude are required in body" });
    }

    // 1. Create a cache key rounded to 2 decimal places so users near each other share the POI response
    const latRounded = Number(latitude).toFixed(2);
    const lngRounded = Number(longitude).toFixed(2);
    const cacheKey = `poi:hospitals:${latRounded}:${lngRounded}`;

    const cachedPOI = await redisClient.get(cacheKey);
    if (cachedPOI) {
      console.log(`[Cache Hit] Serving relief POIs for area ${latRounded},${lngRounded} directly from RAM!`);
      return res.json({ success: true, data: JSON.parse(cachedPOI) });
    }

    const result = await fetchAndSaveReliefCenters(Number(latitude), Number(longitude), radiusMeters ? Number(radiusMeters) : 30000);
    
    // Save to Redis for 10 minutes (600 seconds)
    await redisClient.setEx(cacheKey, 600, JSON.stringify(result));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res) => {
  const center = await getCenterDetails(req.params.id as string);
  res.json({ success: true, data: center });
});

// Admin-only routes (for now just using authenticate)
router.post("/", authMiddleware, validateBody(createReliefCenterSchema), async (req, res) => {
  const center = await addReliefCenter(req.body);
  res.status(201).json({ success: true, data: center });
});

router.patch("/:id", authMiddleware, validateBody(updateReliefCenterSchema), async (req, res) => {
  const center = await updateCenterStatus(req.params.id as string, req.body);
  res.json({ success: true, data: center });
});

export { router as reliefCentersRouter };
