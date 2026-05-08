import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class AddTurnoverAdjustmentDto {
  @IsInt()
  @Min(1)
  amountPoints: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
