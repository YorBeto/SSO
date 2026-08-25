import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard.js';

@Controller('auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async registerUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Get('user/:id')
  @UseGuards(InternalServiceGuard)
  async getUserInfo(@Param('id') id: string) {
    return this.usersService.getUserForVitalGuard(id);
  }
}
