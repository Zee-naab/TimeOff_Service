import { Injectable, NotFoundException } from '@nestjs/common';
import { Location } from '../../database/entities/location.entity';
import { LocationRepository } from '../../database/repositories/location.repository';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly locationRepository: LocationRepository) {}

  findAll(): Promise<Location[]> {
    return this.locationRepository.findAll();
  }

  async findOne(id: number): Promise<Location> {
    const location = await this.locationRepository.findOne(id);
    if (!location) throw new NotFoundException(`Location with ID ${id} not found`);
    return location;
  }

  async create(dto: CreateLocationDto): Promise<Location> {
    const location = this.locationRepository.create(dto);
    return this.locationRepository.save(location);
  }

  async update(id: number, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.findOne(id);
    Object.assign(location, dto);
    return this.locationRepository.save(location);
  }

  async remove(id: number): Promise<void> {
    const location = await this.findOne(id);
    await this.locationRepository.remove(location);
  }
}
