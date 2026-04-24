import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all locations' })
  @ApiResponse({ status: 200, description: 'List of all locations' })
  findAll() {
    return this.locationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Location found' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new location' })
  @ApiResponse({ status: 201, description: 'Location created successfully' })
  @ApiResponse({ status: 409, description: 'Location with this name already exists' })
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a location' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Location updated successfully' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a location' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Location deleted successfully' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.remove(id);
  }
}
