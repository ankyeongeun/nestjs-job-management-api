import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  description?: string;
}
