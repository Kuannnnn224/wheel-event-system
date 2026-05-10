import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateDemoSessionDto {
  @IsString()
  @MinLength(1)
  externalId: string;

  @IsInt()
  @Min(0)
  turnoverPoints: number;
}
