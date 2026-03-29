export type ServiceName = "ai" | "executor" | "web";

export interface HealthResponse {
  status: "ok";
  service: ServiceName;
}
