import { IsInt, Max, Min } from 'class-validator';

export class SimulateSpinDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stageNumber: number;
}
