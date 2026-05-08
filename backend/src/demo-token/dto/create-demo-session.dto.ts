import { IsString, MinLength } from 'class-validator';

export class CreateDemoSessionDto {
  @IsString()
  @MinLength(1)
  externalId: string;
}
