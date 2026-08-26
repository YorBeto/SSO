import { Controller, Post, Body, Get, Param, Put, Delete } from '@nestjs/common';
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
  async getUserById(@Param('id') id: string) {
    return this.usersService.findUserByIdWithPerson(id);
  }

  @Get('all')
  async getAllUsers() {
    return this.usersService.findAllUsersWithPersons();
  }

  @Put(':id')
  async updateUserByAdmin(@Param('id') id: string, @Body() dto: any) {
    return this.usersService.updateUserByAdmin(id, dto);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
