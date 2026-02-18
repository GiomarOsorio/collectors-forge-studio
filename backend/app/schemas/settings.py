from typing import Optional

from pydantic import BaseModel


class AppSettingsUpdate(BaseModel):
    electricity_rate: Optional[float] = None
    failure_rate_percent: Optional[float] = None
    labor_cost_per_hour: Optional[float] = None
    default_margin_percent: Optional[float] = None
    currency: Optional[str] = None


class AppSettingsResponse(BaseModel):
    id: int
    user_id: int
    electricity_rate: float
    failure_rate_percent: float
    labor_cost_per_hour: float
    default_margin_percent: float
    currency: str

    model_config = {"from_attributes": True}
