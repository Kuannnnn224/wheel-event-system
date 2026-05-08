import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateAwardOverridesDto {
  @IsString()
  @MaxLength(120)
  externalId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  stageNumbers: number[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
