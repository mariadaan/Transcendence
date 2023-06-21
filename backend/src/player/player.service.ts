import { Injectable } from '@nestjs/common';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { File } from 'multer';

const prisma = PrismaService.getClient();

@Injectable()
export class PlayerService {

  // CREATE NEW PLAYER
  async createPlayer(createPlayerDto: CreatePlayerDto) {
    try {
      const newPlayer = await prisma.player.create({
        data: {
          username: createPlayerDto.username,
          intra_username: createPlayerDto.username,
          player_stats: {
            create: {
              wins: 0,
              losses: 0,
              ladder_level: 1,
              achievements: {
                'First win': false,
                '10 wins': false,
                '50 wins': false,
                '100 wins': false,
                '10 consecutive wins': false,
                '50 consecutive wins': false,
                'Reached level 5': false,
                'Reached level 10': false,
                'Reached level 20': false,
                'Reached level 50': false,
                'Reached level 100': false,
                'First friend': false,
                '5 friends': false,
                '10 friends': false,
                '100 friends': false,
                'First chat messages sent': false,
                '10 chat messages sent': false,
              },
              status: 'online',
            },
          },
        },
        include: { player_stats: true },
      });
      console.log('User saved in db:', newPlayer.username);
      console.log('PlayerStats initialized:', newPlayer.player_stats);
      return newPlayer.id;
    } catch (error) {
        if (error.code === 'P2002') {
            console.log('Player already exists');
            return this.findIdByUsername(createPlayerDto.username);
        }
        console.error('Error occurred:', error);
    }
}

  async uploadAvatar(id: number, file: File) {
    try {
      const avatarBytes = file.buffer;
      const avatar = await prisma.player.update({
        where: {
          id: id,
        },
        data: {
          avatar: avatarBytes
        }
      });
      return avatar;
    }
    catch (error) {
      console.error(error);
    }
  }

  // GET ID BY USERNAME
  async findIdByUsername(username: string) {
    try {
        const user = await prisma.player.findUnique({
          where: {
            username: username,
          },
          select: {
            id: true,
          },
        });

        return user.id;

      } catch (error) {
        console.error('Error searching for user:', error);
      }
  }

  async findAllOnlinePlayers() {
    return prisma.playerStats.findMany({
        select: {
          player: {
            select: {
              username: true,
            },
          }
        },
    });
  }

  // GET ALL PLAYER STATS (FOR LEADERBOARD)
  async findAllStats() {
    return prisma.playerStats.findMany({
      select: {
        player: {
          select: {
            username: true,
          },
        },
        wins: true,
        losses: true,
        ladder_level: true,
      },
    });
  }

  // GET ALL STATS FOR ONE PLAYER
  findOneStats(id: number) {
    return prisma.playerStats.findUnique({
      where: {
        id: id,
      },
      select: {
        wins: true,
        losses: true,
        ladder_level: true,
      },
    });
  }

  // GET PLAYERS ACHIEVEMENTS
  async findOneAchievements(id: number) {
    try {
      const selectedPlayer = await prisma.playerStats.findUnique({
        where: {
          id: id,
        },
        select: {
          achievements: true,
        },
      });
      return selectedPlayer.achievements;
    }
    catch (error) {
      console.error('Error occurred:', error);
    }
  }

  async findAchievementsTotal(id:number) {
    try {
      const allAchievements = await this.findOneAchievements(id);
      const trueAchievements = Object.values(allAchievements).filter(value => value === true);
      return trueAchievements.length;
    } catch (error) {
      console.error('Error occurred:', error);
    }
  }

  // GET USERNAME
  async findOneUsername(id: number) {
    try {
      const selectedPlayer = await prisma.player.findUnique({
        where: {
          id: id,
        },
        select: {
          username: true
        }
      });
      return selectedPlayer.username;
    }
    catch (error) {
      console.error('Error occurred:', error);
    }
  }

  // GET AVATAR
  async findOneAvatar(id: number) {
    try {
      const selectedPlayer = await prisma.player.findUnique({
        where: {
          id: id,
        },
        select: {
          avatar: true
        }
      });
      return selectedPlayer.avatar;
    }
    catch (error) {
      console.error('Error occurred:', error);
    }
  }

  // GET PERCENTAGE WINS
  async findPercentageWins(id: number) {
    try {
      const playerStats = await this.findOneStats(id);
      const totalGames = playerStats.wins + playerStats.losses;
      return (playerStats.wins / totalGames * 100);
    } catch (error) {
      console.error('Error occurred:', error);
    }
  }

  // CHANGE USERNAME
  async updateUsername(id: number, updatePlayerDto: UpdatePlayerDto) {
    try {
      await prisma.player.update({
        where: {
          id: id,
        },
        data: {
          username: updatePlayerDto.username,
        },
      });
      return updatePlayerDto.username;
    }
    catch (error) {
      if (error.code === 'P2002') {
        return await this.findOneUsername(id);
    }
      console.error('Error occurred:', error);
    }
  }

  // +1 THE WINS
  async updateWins(id: number) {
    try {
      await prisma.player.update({
        where: {
          id: id,
        },
        data: {
          player_stats: {
            update: {
              wins: { increment: 1 },
            },
          },
        },
      });
      this.calcLadderLevel(id);
    }
    catch (error) {
      console.error('Error occurred:', error);
    }
  }

  // +1 LOSSES
  async updateLosses(id: number) {
    try {
      await prisma.player.update({
        where: {
          id: id,
        },
        data: {
          player_stats: {
            update: {
              losses: { increment: 1 },
            },
          },
        },
      });
      this.calcLadderLevel(id);
    }
    catch (error) {
      console.error('Error occurred:', error);
    }
  }
  
  // +1 LEVEL
  async updateLevel(id: number) {
    try {
      await prisma.player.update({
        where: {
          id: id,
        },
        data: {
          player_stats: {
            update: {
              ladder_level: { increment: 1 },
            },
          },
        },
      });
    }
    catch (error) {
      console.error('Error occurred:', error);
    }
  }

  // CHANGE STATUS
  async updateStatus(id: number, updatePlayerDto: UpdatePlayerDto) {
    try {
      await prisma.player.update({
        where: {
          id: id,
        },
        data: {
          player_stats: {
            update: {
              status: updatePlayerDto.status,
            },
          },
        },
      });
    }
    catch (error) {
      console.error('Error occurred:', error);
    }
  }

  // DELETE A PLAYER
  async deletePlayer(id: number) {
    try {
      const deletedPlayer = await prisma.player.delete({
        where: {
          id: id,
        },
      });
      console.log('Player deleted:', deletedPlayer);
      return `This action removes a #${id} player`;
    }
    catch (error) {
      console.error('Error deleting player:', error);
    }
  }

  // UPDATE LADDER LEVEL (only called from the calcLadderLevel function)
  async updateLadderLevel(id: number, newLevel: number) {
    try {
      await prisma.playerStats.update({
        where: {
          id: id,
        },
        data: {
          ladder_level: newLevel,
        },
      });
    }
    catch (error) {
      console.error('Error occurred:', error);
    }
  }

  // CALCULATE LADDER LEVEL SCORE
  async calcLadderLevel(id: number) {
    const playerStatsData = await this.findOneStats(id);
    const achievements = await this.findOneAchievements(id);
    const achievedCount = Object.values(achievements).filter(value => value === true).length;
    let ladderLevel = (playerStatsData.wins * 2) - playerStatsData.losses + (achievedCount * 5);
    ladderLevel = Math.max(ladderLevel, 1);

    this.updateLadderLevel(id, ladderLevel);
  }

  // ACHIEVE AN ACHIEVEMENT
  async achieveAchievement(id: number, updatePlayerDto: UpdatePlayerDto) {
    try {
      let achievements = await this.findOneAchievements(id);
      if (achievements.hasOwnProperty(updatePlayerDto.achieved)) {
        achievements[updatePlayerDto.achieved] = true;
      }
      else {
        return ('Error: invalid achievement');
      }
      await prisma.playerStats.update({
        where: {
          id: id,
        },
        data: {
          achievements: achievements,
        },
      });
      return (achievements);
    } catch (error) {
      console.error('Error occurred:', error);
    }
  }

}