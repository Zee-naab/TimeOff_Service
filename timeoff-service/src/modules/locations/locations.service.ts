import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './location.entity';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
  ) {}

  findAll(): Promise<Location[]> {
    return this.locationRepository.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: number): Promise<Location> {
    const location = await this.locationRepository.findOneBy({ id });
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }
    return location;
  }

  async create(dto: CreateLocationDto): Promise<Location> {
    const existing = await this.locationRepository.findOneBy({ name: dto.name });
    if (existing) {
      throw new ConflictException(`Location with name "${dto.name}" already exists`);
    }
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
