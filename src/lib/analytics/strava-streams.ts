/**
 * Strava Streams Fetcher
 *
 * Fetches second-by-second stream data for a Strava activity.
 * Streams include heart rate, pace, power, cadence, altitude, etc.
 */

export interface StravaStream {
  time: number[];          // seconds since start
  distance: number[];      // meters
  heartrate: number[];     // bpm
  velocity_smooth: number[]; // m/s
  altitude: number[];      // meters
  watts: number[];         // power in watts
  cadence: number[];       // rpm or spm
}

export interface StravaStreamResponse {
  type: string;
  data: number[];
  series_type: string;
  original_size: number;
  resolution: string;
}

const STREAM_KEYS = [
  "heartrate",
  "time",
  "distance",
  "velocity_smooth",
  "altitude",
  "watts",
  "cadence",
] as const;

/**
 * Fetch activity streams from Strava API.
 * Returns null if streams are unavailable (rate limited, no sensor data, etc.)
 */
export async function fetchStravaStreams(
  activityId: number,
  accessToken: string
): Promise<StravaStream | null> {
  try {
    const keys = STREAM_KEYS.join(",");
    const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${keys}&key_type=time`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`Strava rate limited when fetching streams for activity ${activityId}`);
      } else {
        console.warn(`Strava streams API error ${response.status} for activity ${activityId}`);
      }
      return null;
    }

    const rawStreams: StravaStreamResponse[] = await response.json();

    // Convert array of stream objects to our structured format
    const streams: StravaStream = {
      time: [],
      distance: [],
      heartrate: [],
      velocity_smooth: [],
      altitude: [],
      watts: [],
      cadence: [],
    };

    for (const stream of rawStreams) {
      const key = stream.type as keyof StravaStream;
      if (key in streams) {
        streams[key] = stream.data;
      }
    }

    // Must have at least time data to be useful
    if (streams.time.length === 0) {
      console.warn(`No time stream data for activity ${activityId}`);
      return null;
    }

    return streams;
  } catch (error) {
    console.error(`Failed to fetch Strava streams for activity ${activityId}:`, error);
    return null;
  }
}

/**
 * Check if stream data has meaningful heart rate data
 */
export function hasHeartRateData(streams: StravaStream): boolean {
  return streams.heartrate.length > 0 && streams.heartrate.some((hr) => hr > 0);
}

/**
 * Check if stream data has power data
 */
export function hasPowerData(streams: StravaStream): boolean {
  return streams.watts.length > 0 && streams.watts.some((w) => w > 0);
}

/**
 * Check if stream data has altitude data
 */
export function hasAltitudeData(streams: StravaStream): boolean {
  return streams.altitude.length > 0;
}

/**
 * Check if stream data has cadence data
 */
export function hasCadenceData(streams: StravaStream): boolean {
  return streams.cadence.length > 0 && streams.cadence.some((c) => c > 0);
}
