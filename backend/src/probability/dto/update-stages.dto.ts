import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

export class PrizeConfigInputDto {
  @IsString()
  @Matches(/^[A-E]$/)
  rewardCode: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  lowWeight: number;

  @IsInt()
  @Min(0)
  highWeight: number;

  @IsInt()
  @Min(0)
  prizeWeight: number;

  @IsInt()
  @Min(0)
  amountPoints: number;

  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class StageConfigInputDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stageNumber: number;

  @IsInt()
  @Min(0)
  turnoverThresholdPoints: number;

  @IsInt()
  @Min(0)
  lowTableWeight: number;

  @IsInt()
  @Min(0)
  highTableWeight: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrizeConfigInputDto)
  prizes: PrizeConfigInputDto[];
}

export class UpdateStagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageConfigInputDto)
  stages: StageConfigInputDto[];
}
