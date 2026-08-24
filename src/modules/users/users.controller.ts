import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';

@Controller('auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async registerUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Get('user/:id')
  async getUserInfo(@Param('id') id: string) {
    return this.usersService.getUserForVitalGuard(id);
  }
}
