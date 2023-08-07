import { Injectable} from '@nestjs/common';
import { Socket } from 'socket.io';
import { Match } from './match/match';
import { MatchInstance } from './match/match-instance';
import { PlayerService } from '../player/player.service';

interface inviteList {
	player_id: number; 
	opponent_id: number;
	socket_id: string;
}

interface opponentList {
	opponent_id: number; 
}

interface WaitingList {
	player_id: number; 
	socket_id: string;
}

@Injectable()
export class PongService {
	private readonly playerService = new PlayerService;
	private opponentList: opponentList[] = [];
	private inviteList: inviteList[] = [];
	private waitingList: WaitingList[] = [];
	private matchList: { [key: number]: MatchInstance } = {};

	// CREATE MATCH VIA INVITE
	async inviteAccepted(client: Socket, player_id: number){
		const id = await this.playerService.findOneIntraUsername(player_id);
		client.to(id).emit('redirecting', player_id);
	}

	async handleAcceptInvite(client: Socket, p1_id: number, p1_socket_id: string, p2_id: number, p2_socket_id: string){
		const p1 = {
			player_id: p1_id,
			socket_id: p1_socket_id,
		}
		const p2 = {
			player_id: p2_id,
			socket_id: p2_socket_id,
		}
	
		const player1 = await this.playerService.findOneIntraUsername(p1_id);
		const player2 = await this.playerService.findOneIntraUsername(p2_id);
		// CREATE MATCH
		this.createMatch(client, p1, p2);
		// client.to(player1).emit('startInviteMatch')
		// client.to.emit('startInviteMatch')

		const index = this.inviteList.findIndex(player => player.player_id === p1_id);
		if (index !== -1){
			console.log('removed', p1_id, 'from the invitelist')
  			this.inviteList.splice(index, 1);
		}
	}

	handleDeclineInvite(client: Socket, player_id1: number){
		const index = this.inviteList.findIndex(player => player.player_id === player_id1);
		if (index !== -1){
			console.log('removed', player_id1, 'from the invitelist')
  			this.inviteList.splice(index, 1);
		}
		const index2 = this.opponentList.findIndex(player => player.opponent_id === player_id1);
		if (index2 !== -1) {
			console.log('player', player_id1, 'left the invite list');
			this.inviteList.splice(index, 1);
		}
	}

	async handleInvite(client: Socket, player_id: number, opponent_id: number, socket_id:string): Promise<void>{
		const playerInfo = {
			player_id: player_id,
			opponent_id: opponent_id,
			socket_id: socket_id,
		}
		const checkInMatch = this.searchPlayerInMatch(client)
		if (checkInMatch){
			console.log("can't send an invite, you are already in a match")
			client.emit('alreadyInMatch', socket_id);
			return ;
		}

		// cant sent an invite when you are already inviting someone
		if (!this.inviteList.some((player) => player.player_id === player_id)) {
			this.inviteList.push(playerInfo);
			console.log(player_id, socket_id, 'send out an invite');
		} else {
			console.log(this.inviteList)
			console.log(player_id, 'already send out an invite!!');
			return;
		}

		// can't send an invite to someone who has already been invited
		const opponentInfo = {
			opponent_id: opponent_id,
		}
		if (!this.opponentList.some((player) => player.opponent_id === opponent_id)) {
			this.opponentList.push(opponentInfo);
		} else {
			console.log(player_id, "you can't invite someone who already received an invite");
			return;
		}
		console.log('send an invitation to', opponent_id);
		const Opponent = await this.playerService.findOneIntraUsername(opponent_id);
		client.to(Opponent).emit('sendInvite', {
			player_id: player_id,
			opponent_id: opponent_id, 
			socket_id: socket_id
		});
	}

	// CREATE MATCH VIA PLAY PAGE
	async handleJoinMatchmaking (client: Socket, player_id: number, socket_id: string): Promise<void>{
		const playerInfo = {
			player_id: player_id,
			socket_id: socket_id,
		}
		if (!this.waitingList.some((player) => player.socket_id === socket_id)) {
			this.waitingList.push(playerInfo);
			console.log('added', player_id, socket_id, 'to waitinglist');
		} else {
			console.log(socket_id, 'is already in the waiting list');
		}
		const checkInMatch = this.searchPlayerInMatch(client)
		if (checkInMatch){
			console.log("can't start a match, you are already in a match")
			client.emit('alreadyInMatch', socket_id);
			return ;
		}
		if (this.waitingList.length >= 2){
			console.log('two people in waiting list');
			const p1 = this.waitingList.shift()
			const p2 = this.waitingList.shift()
			if (!p1 || !p2)
				return ;
			this.createMatch(client, p1, p2);
		}
	}

	createMatch(client: Socket, player1: any, player2: any): Match {
		const match = new Match(player1, player2);
		this.matchList[match.id] = new MatchInstance(match);
		this.matchList[match.id].startGame();
		// if (client.id == player1.socket_id)
		// 	client.emit('startMatch', { player1: { player_id: player1.player_id, socket_id: player1.socket_id }, player2: { player_id: player2.player_id, socket_id: player2.socket_id }});
		// else
		console.log("p1", player1, "p2", player2);
		console.log("MATCH ID:", match.id)
		client.to(player1.socket_id).emit('startMatch', { 
			player1: { player_id: player1.player_id, socket_id: player1.socket_id }, 
			player2: { player_id: player2.player_id, socket_id: player2.socket_id },
			matchId: match.id,
		});
		client.emit('startMatch', { 
			player1: { player_id: player1.player_id, socket_id: player1.socket_id },
			player2: { player_id: player2.player_id, socket_id: player2.socket_id },
			matchId: match.id,
		});
		return match;
	}

	checkMatchEnding(match: Match): void {
		if (match.score1 === 10 || match.score2 === 10){
			delete this.matchList[match.id]
			console.log("match", match.id, "deleted")
		}
	}

	async tick(client: Socket): Promise<void> {
		for (const matchId in this.matchList) {
			this.matchList[matchId].tick(client)
			this.checkMatchEnding(this.matchList[matchId].getMatchId())
		}
	}

	handleMove(client: Socket, data: any) {
		if (!data.socket_match_id)
			return ;
		if (!this.matchList[data.socket_match_id])
			return ;
		this.matchList[data.socket_match_id].handleMove(client, data);
	}

	handleSoloMatch(client: Socket){
		const inSolomatch = this.searchPlayerInMatch(client)
		if (inSolomatch){
			console.log("can't start a solo match, you are already in a match");
			client.emit('alreadyInMatch');
			return ;
		}
	}

	handleDisconnect(client: Socket): void {
		const disconnectedId = client.id;
		console.log("player", client.id, "disconnecetd");
		const index = this.waitingList.findIndex(player => player.socket_id === disconnectedId);
		if (index !== -1) {
			console.log('player', disconnectedId, 'left the waiting list');
			this.waitingList.splice(index, 1);
		}
		const index2 = this.inviteList.findIndex(player => player.socket_id === disconnectedId);
		if (index2 !== -1) {
			console.log('player', disconnectedId, 'left the invite list');
			this.inviteList.splice(index, 1);
		}
		const disconnectedMatch = this.searchPlayerInMatch(client)
		console.log("DISCONNECTED ID", disconnectedMatch)
		if (!disconnectedMatch){
			console.log("Error in disconnecting match")
			return ;
		}
		this.matchList[disconnectedMatch].handleDisconnect(client)
		delete this.matchList[disconnectedMatch];
	}

	searchPlayerInMatch(client: Socket): string {
		for (const matchId in this.matchList) {
			if (this.matchList[matchId].getPlayerSocketId(1) === client.id ||
				this.matchList[matchId].getPlayerSocketId(2) === client.id){
			return matchId;
			}
		}
		return (null);
	}
}
