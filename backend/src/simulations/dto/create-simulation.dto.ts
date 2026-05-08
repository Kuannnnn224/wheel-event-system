import { IsInt, Max, Min } from 'class-validator';

export class CreateSimulationDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stageNumber: number;

  @IsInt()
  @Min(1)
  @Max(10_000_000)
  count: number;
}
