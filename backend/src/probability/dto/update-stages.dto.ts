import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class PrizeConfigInputDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  weight: number;

  @IsInt()
  @Min(0)
  amountPoints: number;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class StageConfigInputDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stageNumber: number;

  @IsInt()
  @Min(0)
  turnoverThresholdPoints: number;

  @IsBoolean()
  enabled: boolean;

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
