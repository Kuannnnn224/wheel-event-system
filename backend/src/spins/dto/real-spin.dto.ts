import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class RealSpinDto {
  @IsString()
  token: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stageNumber: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
