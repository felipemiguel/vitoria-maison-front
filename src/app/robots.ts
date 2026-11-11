import type { MetadataRoute } from "next";
import { getSeoConfig } from "@/features/seo/config";
import { buildRobots } from "@/features/seo/robots";

export default function robots(): MetadataRoute.Robots { return buildRobots(getSeoConfig()); }
