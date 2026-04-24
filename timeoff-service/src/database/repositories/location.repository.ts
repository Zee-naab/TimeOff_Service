import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../entities/location.entity';

@Injectable()
export class LocationRepository {
  constructor(
    @InjectRepository(Location)
    private readonly repo: Repository<Location>,
  ) {}

  findAll(): Promise<Location[]> {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  findOne(id: number): Promise<Location | null> {
    return this.repo.findOneBy({ id });
  }

  create(data: Partial<Location>): Location {
    return this.repo.create(data);
  }

  save(location: Location): Promise<Location> {
    return this.repo.save(location);
  }

  remove(location: Location): Promise<Location> {
    return this.repo.remove(location);
  }
}
