import { IsInt, IsString, Max, Min } from 'class-validator';

export class RealSpinDto {
  @IsString()
  token: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stageNumber: number;
}
