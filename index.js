const axios = require("axios").default;
const express = require("express");
const bodyParser = require("body-parser");
const sql = require("mssql/msnodesqlv8");
const fantasy = require("espn-fantasy-football-api/node-dev");
require("msnodesqlv8");
var league;
var manualPlayers = [];
var apiPlayers = [];
var teams = {};
let update = true;

const connectionOptions = {
  database: "Fantasy",
  server: "localhost",
  driver: "msnodesqlv8",
  options: {
    trustedConnection: true,
  },
};

let mySWID = "{B074D11E-6326-4BCB-B4D1-1E63267BCB7B}";
let myEspnS2 =
  "AEBoe6bIZwp2ZsNjsi%2F7I4LaxmMitP360f3p6fc4LhlIgSoqBvuPrad%2FBcmQ9WoRjgYXPSp7aguNKkLGVBDmcv3Zs%2FPLDb3zXBhuSqSXp13j0Wxy%2BqRkaFBlPHRnl3jZAhNTbl6HXhMhLS%2FZjlVU7%2F6GHEsj6DxJuaxtIbZ4th6%2FOE1og4SICX5NlArZECR5MLggiopCzx6C9KitxqKo5Lp0KQLZjW7D51II1bnPcOJ6%2BtzCwjHo4iXWneedCT1FQfTOcFiASny%2ByTorH0YcSGT7";

let fantasyClient = new fantasy.Client({ leagueId: 989451 });
fantasyClient.setCookies({ espnS2: myEspnS2, SWID: mySWID });

async function runQuery(query) {
  if (!update) {
    return true;
  }
  
  var result = [];
  try {
    var connection = new sql.ConnectionPool(connectionOptions);

    await connection.connect();

    var data = await connection.request().query(query);

    if (data.recordset != undefined) {
      for (let i = 0; i < data.recordset.length; i++) {
        result.push(data.recordset[i]);
      }
    } else {
      result = true;
    }

    connection.close();
  } catch (error) {
    console.log(error);
    return false;
  }
  return result;
}

async function init() {
  //get league and team info
  let leagueRes = await axios.get(
    "https://fantasy.espn.com/apis/v3/games/ffl/seasons/2021/segments/0/leagues/989451?view=mInvited&view=mSettings&view=mTeam&view=modular&view=mNav",
    {
      headers: {
        Cookie: `SWID={${mySWID}}; Path=/; Expires=Thu, 15 Sep 2022 04:28:15 GMT; espn_s2=${myEspnS2}; Path=/; Expires=Thu, 15 Sep 2022 04:27:06 GMT;`,
      },
    }
  );

  league = leagueRes.data;
  teams = league.teams;
  
  league.scoringPeriodId = 4;

  let teamResults = await fantasyClient.getTeamsAtWeek({
    seasonId: 2021,
    scoringPeriodId: 18,
  });
  
  var filters = {
    "players": {
        "limit": 1500,
        "sortDraftRanks": {
            "sortPriority": 100,
            "sortAsc": true,
            "value": "STANDARD"
        }
    }
  };

  //get player info
  let playersRes = await axios.get(
    `https://fantasy.espn.com/apis/v3/games/ffl/seasons/2021/segments/0/leagues/989451?scoringPeriodId=${18}&view=kona_player_info`,
    {
      headers: {
        Cookie: `SWID={${mySWID}}; Path=/; Expires=Thu, 15 Sep 2022 04:28:15 GMT; espn_s2=${myEspnS2}; Path=/; Expires=Thu, 15 Sep 2022 04:27:06 GMT;`,
        "x-fantasy-filter": JSON.stringify(filters)
      },
    }
  );

  manualPlayers = playersRes.data.players;

  let freeAgentResults = await fantasyClient.getFreeAgents({
    seasonId: 2021,
    scoringPeriodId: league.scoringPeriodId - 1,
  });
  
  for (let freeAgent of freeAgentResults) {
    apiPlayers.push(freeAgent);
  }
  
  let boxScoreResults = await fantasyClient.getBoxscoreForWeek({
    seasonId: 2021,
    scoringPeriodId: league.scoringPeriodId - 1,
    matchupPeriodId: league.scoringPeriodId - 1
  });
  
  for (let boxScoreMatchup of boxScoreResults) {
    let homeRoster = boxScoreMatchup.homeRoster;
    let awayRoster = boxScoreMatchup.awayRoster;
    
    for (let boxScorePlayer of homeRoster) {
      apiPlayers.push(boxScorePlayer);
    }
    
    for (let boxScorePlayer of awayRoster) {
      apiPlayers.push(boxScorePlayer);
    }
  }
  
  await updateTeams(teamResults, boxScoreResults);

  await updatePlayers(apiPlayers);
  
  await updatePlayerStats(apiPlayers);
  
  let app = express();

  app.use("/", express.static("client"));

  port = 8082;

  app.listen(this.port, () => {
    console.log(`Listening on port ${this.port}`);
  });

  app.get("/league", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(league);
  });

  app.get("/teams", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(league.teams);
  });
  
}

async function updatePlayerStats(players, boxScoreResults) {
  let query = "";
  for (let player of players) {
    let stats = player.rawStats;
    let pointsAtWeek = player.totalPoints === undefined ? 0 : player.totalPoints;
    
    query += `
    IF NOT EXISTS(select 1 from PlayerStat where PlayerId = ${player.player.id} and ScoringPeriodID = ${league.scoringPeriodId - 1})
        insert into PlayerStat
        (
          PlayerId,
          PassingYards,
          PassingTouchdown,
          Passing2PtConversion,
          PassingInterceptions,
          RushingYards,
          RushingTouchdowns,
          Rushing2PtConversions,
          ReceivingYards,
          ReceivingTouchdowns,
          Receiving2PtConversions,
          RecevingReceptions,
          LostFumbles,
          MadeFieldGoalsFrom50Plus,
          MadeFieldGoalsFrom40To49,
          MadeFieldGoalsFromUnder40,
          MissedFieldGoals,
          MadeExtraPoints,
          MissedExtraPoints,
          Defensive0PointsAllowed,
          Defensive1To6PointsAllowed,
          Defensive7To13PointsAllowed,
          Defensive14To17PointsAllowed,
          Defensive28To34PointsAllowed,
          Defensive35To45PointsAllowed,
          DefensiveBlockedKickForTouchdowns,
          DefensiveInterceptions,
          DefensiveFumbles,
          DefensiveBlockedKicks,
          DefensiveSafeties,
          DefensiveSacks,
          KickoffReturnTouchdown,
          PuntReturnTouchdown,
          FumbleReturnTouchdown,
          InterceptionReturnTouchdown,
          Defensive100To199YardsAllowed,
          Defensive200To299YardsAllowed,
          Defensive350To399YardsAllowed,
          Defensive400To449YardsAllowed,
          Defensive450To499YardsAllowed,
          Defensive500To549YardsAllowed,
          DefensiveOver550YardsAllowed,
          Position,
          PointsAtWeek,
          ScoringPeriodID
        )
          
          values
          (
            ${player.player.id},
            ${stats.passingYards === undefined ? 'null' : stats.passingYards},
            ${stats.passingTouchdowns === undefined ? 'null' : stats.passingTouchdowns},
            ${stats.passing2PtConversions === undefined ? 'null' : stats.passing2PtConversions},
            ${stats.passingInterceptions === undefined ? 'null' : stats.passingInterceptions},
            ${stats.rushingYards === undefined ? 'null' : stats.rushingYards},
            ${stats.rushingTouchdowns === undefined ? 'null' : stats.rushingTouchdowns},
            ${stats.rushing2PtConversions === undefined ? 'null' : stats.rushing2PtConversions},
            ${stats.receivingYards === undefined ? 'null' : stats.receivingYards},
            ${stats.receivingTouchdowns === undefined ? 'null' : stats.receivingTouchdowns},
            ${stats.receiving2PtConversions === undefined ? 'null' : stats.receiving2PtConversions},
            ${stats.recevingReceptions === undefined ? 'null' : stats.recevingReceptions},
            ${stats.lostFumbles === undefined ? 'null' : stats.lostFumbles},
            ${stats.madeFieldGoalsFrom50Plus === undefined ? 'null' : stats.madeFieldGoalsFrom50Plus},
            ${stats.madeFieldGoalsFrom40To49 === undefined ? 'null' : stats.madeFieldGoalsFrom40To49},
            ${stats.madeFieldGoalsFromUnder40 === undefined ? 'null' : stats.madeFieldGoalsFromUnder40},
            ${stats.missedFieldGoals === undefined ? 'null' : stats.missedFieldGoals},
            ${stats.madeExtraPoints === undefined ? 'null' : stats.madeExtraPoints},
            ${stats.missedExtraPoints === undefined ? 'null' : stats.missedExtraPoints},
            ${stats.defensive0PointsAllowed === undefined ? 'null' : stats.defensive0PointsAllowed},
            ${stats.defensive1To6PointsAllowed === undefined ? 'null' : stats.defensive1To6PointsAllowed},
            ${stats.defensive7To13PointsAllowed === undefined ? 'null' : stats.defensive7To13PointsAllowed},
            ${stats.defensive14To17PointsAllowed === undefined ? 'null' : stats.defensive14To17PointsAllowed},
            ${stats.defensive28To34PointsAllowed === undefined ? 'null' : stats.defensive28To34PointsAllowed},
            ${stats.defensive35To45PointsAllowed === undefined ? 'null' : stats.defensive35To45PointsAllowed},
            ${stats.defensiveBlockedKickForTouchdowns === undefined ? 'null' : stats.defensiveBlockedKickForTouchdowns},
            ${stats.defensiveInterceptions === undefined ? 'null' : stats.defensiveInterceptions},
            ${stats.defensiveFumbles === undefined ? 'null' : stats.defensiveFumbles},
            ${stats.defensiveBlockedKicks === undefined ? 'null' : stats.defensiveBlockedKicks},
            ${stats.defensiveSafeties === undefined ? 'null' : stats.defensiveSafeties},
            ${stats.defensiveSacks === undefined ? 'null' : stats.defensiveSacks},
            ${stats.kickoffReturnTouchdown === undefined ? 'null' : stats.kickoffReturnTouchdown},
            ${stats.puntReturnTouchdown === undefined ? 'null' : stats.puntReturnTouchdown},
            ${stats.fumbleReturnTouchdown === undefined ? 'null' : stats.fumbleReturnTouchdown},
            ${stats.interceptionReturnTouchdown === undefined ? 'null' : stats.interceptionReturnTouchdown},
            ${stats.defensive100To199YardsAllowed === undefined ? 'null' : stats.defensive100To199YardsAllowed},
            ${stats.defensive200To299YardsAllowed === undefined ? 'null' : stats.defensive200To299YardsAllowed},
            ${stats.defensive350To399YardsAllowed === undefined ? 'null' : stats.defensive350To399YardsAllowed},
            ${stats.defensive400To449YardsAllowed === undefined ? 'null' : stats.defensive400To449YardsAllowed},
            ${stats.defensive450To499YardsAllowed === undefined ? 'null' : stats.defensive450To499YardsAllowed},
            ${stats.defensive500To549YardsAllowed === undefined ? 'null' : stats.defensive500To549YardsAllowed},
            ${stats.defensiveOver550YardsAllowed === undefined ? 'null' : stats.defensiveOver550YardsAllowed},
            ${player.position === undefined ? 'null' : "'" + player.position + "'"},
            ${pointsAtWeek},
            ${league.scoringPeriodId - 1}
          )
    ELSE
        update PlayerStat set
        
        PlayerId =                          ${player.player.id},
        PassingYards =                      ${stats.passingYards === undefined ? 'null' : stats.passingYards},
        PassingTouchdown =                  ${stats.passingTouchdowns === undefined ? 'null' : stats.passingTouchdowns},
        Passing2PtConversion =              ${stats.passing2PtConversions === undefined ? 'null' : stats.passing2PtConversions},
        PassingInterceptions =              ${stats.passingInterceptions === undefined ? 'null' : stats.passingInterceptions},
        RushingYards =                      ${stats.rushingYards === undefined ? 'null' : stats.rushingYards},
        RushingTouchdowns =                 ${stats.rushingTouchdowns === undefined ? 'null' : stats.rushingTouchdowns},
        Rushing2PtConversions =             ${stats.rushing2PtConversions === undefined ? 'null' : stats.rushing2PtConversions},
        ReceivingYards =                    ${stats.receivingYards === undefined ? 'null' : stats.receivingYards},
        ReceivingTouchdowns =               ${stats.receivingTouchdowns === undefined ? 'null' : stats.receivingTouchdowns},
        Receiving2PtConversions =           ${stats.receiving2PtConversions === undefined ? 'null' : stats.receiving2PtConversions},
        RecevingReceptions =                ${stats.recevingReceptions === undefined ? 'null' : stats.recevingReceptions},
        LostFumbles =                       ${stats.lostFumbles === undefined ? 'null' : stats.lostFumbles},
        MadeFieldGoalsFrom50Plus =          ${stats.madeFieldGoalsFrom50Plus === undefined ? 'null' : stats.madeFieldGoalsFrom50Plus},
        MadeFieldGoalsFrom40To49 =          ${stats.madeFieldGoalsFrom40To49 === undefined ? 'null' : stats.madeFieldGoalsFrom40To49},
        MadeFieldGoalsFromUnder40 =         ${stats.madeFieldGoalsFromUnder40 === undefined ? 'null' : stats.madeFieldGoalsFromUnder40},
        MissedFieldGoals =                  ${stats.missedFieldGoals === undefined ? 'null' : stats.missedFieldGoals},
        MadeExtraPoints =                   ${stats.madeExtraPoints === undefined ? 'null' : stats.madeExtraPoints},
        MissedExtraPoints =                 ${stats.missedExtraPoints === undefined ? 'null' : stats.missedExtraPoints},
        Defensive0PointsAllowed =           ${stats.defensive0PointsAllowed === undefined ? 'null' : stats.defensive0PointsAllowed},
        Defensive1To6PointsAllowed =        ${stats.defensive1To6PointsAllowed === undefined ? 'null' : stats.defensive1To6PointsAllowed},
        Defensive7To13PointsAllowed =       ${stats.defensive7To13PointsAllowed === undefined ? 'null' : stats.defensive7To13PointsAllowed},
        Defensive14To17PointsAllowed =      ${stats.defensive14To17PointsAllowed === undefined ? 'null' : stats.defensive14To17PointsAllowed},
        Defensive28To34PointsAllowed =      ${stats.defensive28To34PointsAllowed === undefined ? 'null' : stats.defensive28To34PointsAllowed},
        Defensive35To45PointsAllowed =      ${stats.defensive35To45PointsAllowed === undefined ? 'null' : stats.defensive35To45PointsAllowed},
        DefensiveBlockedKickForTouchdowns = ${stats.defensiveBlockedKickForTouchdowns === undefined ? 'null' : stats.defensiveBlockedKickForTouchdowns},
        DefensiveInterceptions =            ${stats.defensiveInterceptions === undefined ? 'null' : stats.defensiveInterceptions},
        DefensiveFumbles =                  ${stats.defensiveFumbles === undefined ? 'null' : stats.defensiveFumbles},
        DefensiveBlockedKicks =             ${stats.defensiveBlockedKicks === undefined ? 'null' : stats.defensiveBlockedKicks},
        DefensiveSafeties =                 ${stats.defensiveSafeties === undefined ? 'null' : stats.defensiveSafeties},
        DefensiveSacks =                    ${stats.defensiveSacks === undefined ? 'null' : stats.defensiveSacks},
        KickoffReturnTouchdown =            ${stats.kickoffReturnTouchdown === undefined ? 'null' : stats.kickoffReturnTouchdown},
        PuntReturnTouchdown =               ${stats.puntReturnTouchdown === undefined ? 'null' : stats.puntReturnTouchdown},
        FumbleReturnTouchdown =             ${stats.fumbleReturnTouchdown === undefined ? 'null' : stats.fumbleReturnTouchdown},
        InterceptionReturnTouchdown =       ${stats.interceptionReturnTouchdown === undefined ? 'null' : stats.interceptionReturnTouchdown},
        Defensive100To199YardsAllowed =     ${stats.defensive100To199YardsAllowed === undefined ? 'null' : stats.defensive100To199YardsAllowed},
        Defensive200To299YardsAllowed =     ${stats.defensive200To299YardsAllowed === undefined ? 'null' : stats.defensive200To299YardsAllowed},
        Defensive350To399YardsAllowed =     ${stats.defensive350To399YardsAllowed === undefined ? 'null' : stats.defensive350To399YardsAllowed},
        Defensive400To449YardsAllowed =     ${stats.defensive400To449YardsAllowed === undefined ? 'null' : stats.defensive400To449YardsAllowed},
        Defensive450To499YardsAllowed =     ${stats.defensive450To499YardsAllowed === undefined ? 'null' : stats.defensive450To499YardsAllowed},
        Defensive500To549YardsAllowed =     ${stats.defensive500To549YardsAllowed === undefined ? 'null' : stats.defensive500To549YardsAllowed},
        DefensiveOver550YardsAllowed =      ${stats.defensiveOver550YardsAllowed === undefined ? 'null' : stats.defensiveOver550YardsAllowed},
        Position =                          ${player.position === undefined ? 'null' : "'" + player.position + "'"},
        PointsAtWeek =                      ${pointsAtWeek},
        ScoringPeriodId =                   ${league.scoringPeriodId - 1}
        
        where PlayerId = ${player.player.id} and ScoringPeriodID = ${league.scoringPeriodId - 1}
        `;
  }
  await runQuery(query);
  console.log('done');
}

//syncs manual API team from Node API team
function getManualPlayer(playerId, player) {
  for (let manualPlayer of manualPlayers) {
    if (manualPlayer.id === playerId) {
      return manualPlayer;
    }
  }
  return false;
}

//updates the DB with player info
async function updatePlayers(players) {
  let query = "";

  for (let player of players) {
    
    let apiPlayer = player.player === undefined ? player : player.player;
    
    if (apiPlayer.id === undefined) {
      console.log('stop');
    }
    
    let manualPlayer = getManualPlayer(apiPlayer.id, player);
    
    if (manualPlayer.player.ownership === undefined) {
      manualPlayer.player.ownership = {
        percentStarted : 'null',
        percentOwned : 'null',
        percentChange : 'null'
      };
    }
    
    query += `
    IF NOT EXISTS(select 1 from Player where Id = ${apiPlayer.id})
        insert into Player
        (
          Id, 
          OnTeamId, 
          AvailabilityStatus, 
          DefaultPosition, 
          FirstName, 
          LastName, 
          FullName, 
          InjuryStatus, 
          IsInjured, 
          ProTeam, 
          PercentStarted, 
          PercentOwned, 
          PercentChange
        )
        values 
        (
          ${apiPlayer.id},
          ${manualPlayer.onTeamId},
          '${apiPlayer.availabilityStatus}',
          '${apiPlayer.defaultPosition}',
          '${(apiPlayer.firstName.replace("'", "''"))}',
          '${(apiPlayer.lastName).replace("'", "''")}',
          '${(apiPlayer.fullName).replace("'", "''")}',
          '${apiPlayer.injuryStatus}',
          ${apiPlayer.isInjured === true ? 1 : 0},
          '${(apiPlayer.proTeam === undefined ? 'None' : apiPlayer.proTeam)}',
          ${apiPlayer.percentStarted === undefined ? manualPlayer.player.ownership.percentStarted : apiPlayer.percentStarted},
          ${apiPlayer.percentOwned === undefined ? manualPlayer.player.ownership.percentOwned : apiPlayer.percentOwned },
          ${apiPlayer.percentChange === undefined ? manualPlayer.player.ownership.percentChange : apiPlayer.percentChange }
          
        )
    ELSE
        update Player set
        
        ID =                  ${apiPlayer.id},
        OnTeamId =            ${manualPlayer.onTeamId},
        AvailabilityStatus = '${apiPlayer.availabilityStatus}',
        DefaultPosition =    '${apiPlayer.defaultPosition}',
        FirstName =          '${(apiPlayer.firstName.replace("'", "''"))}',
        LastName =           '${(apiPlayer.lastName).replace("'", "''")}',
        FullName =           '${(apiPlayer.fullName).replace("'", "''")}',
        InjuryStatus =       '${apiPlayer.injuryStatus}',
        IsInjured =           ${apiPlayer.isInjured === true ? 1 : 0},
        ProTeam =            '${apiPlayer.proTeam === undefined ? 'None' : apiPlayer.proTeam}',
        PercentStarted =      ${apiPlayer.percentStarted === undefined ? manualPlayer.player.ownership.percentStarted : apiPlayer.percentStarted},
        PercentOwned =        ${apiPlayer.percentOwned === undefined ? manualPlayer.player.ownership.percentOwned : apiPlayer.percentOwned },
        PercentChange =       ${apiPlayer.percentChange === undefined ? manualPlayer.player.ownership.percentChange : apiPlayer.percentChange }
        
        where Id = ${apiPlayer.id}
        `;
  }

  await runQuery(query);
  
}

//syncs manual API team from Node API team
function getManualTeam(teamId) {
  for (let team of teams) {
    if (team.id === teamId) {
      return team;
    }
  }
  return false;
}

function getBoxScoreTeamScore(teamId, boxScoreResults) {
  for (let boxScoreMatchup of boxScoreResults) {
    if (boxScoreMatchup.homeTeamId === teamId) {
      return boxScoreMatchup.homeScore;
    }
    else if (boxScoreMatchup.awayTeamId === teamId) {
      return boxScoreMatchup.awayScore;
    }
  }
}

//updates the DB with Team info
async function updateTeams(teamResults, boxScoreResults) {
  let query = "";

  for (let team of teamResults) {
    
    let manualTeam = getManualTeam(team.id);
    let teamScoreAtWeek = getBoxScoreTeamScore(team.id, boxScoreResults);

    query += `
  IF NOT EXISTS(select 1 from Team where Id = ${team.id} and ScoringPeriodId = ${league.scoringPeriodId - 1})
      insert into Team
      (
        Id, 
        Abbrev, 
        Location, 
        Nickname, 
        Name, 
        TotalPoints, 
        TotalPointsAgainst, 
        StreakType, 
        StreakLength, 
        Ties, 
        Wins, 
        Losses, 
        WinningPercentage, 
        Acquisitions, 
        Drops, 
        MoveToActive, 
        Trades, 
        WaiverRank, 
        ProjectedRank, 
        DraftDayProjectedRank,
        ScoringPeriodId,
        ScoreAtWeek
      )
      values (
          ${team.id}, 
          '${team.abbreviation}', 
          '${manualTeam.location.replace("'", "''")}',
          '${manualTeam.nickname}', 
          '${team.name.replace("'", "''")}', 
          ${team.regularSeasonPointsFor}, 
          ${team.regularSeasonPointsAgainst}, 
          '${manualTeam.record.overall.streakType}', 
          ${manualTeam.record.overall.streakLength}, 
          ${team.ties}, 
          ${team.wins},
          ${team.losses},
          ${team.winningPercentage},
          ${manualTeam.transactionCounter.acquisitions}, 
          ${manualTeam.transactionCounter.drops}, 
          ${manualTeam.transactionCounter.moveToActive}, 
          ${manualTeam.transactionCounter.trades}, 
          ${manualTeam.waiverRank},
          ${manualTeam.currentProjectedRank}, 
          ${manualTeam.draftDayProjectedRank},
          ${league.scoringPeriodId - 1},
          ${teamScoreAtWeek}
        )
  ELSE
      update Team set
          Id =                    ${team.id},
          Abbrev =                '${team.abbreviation}',
          Location =              '${manualTeam.location.replace("'", "''")}',
          Nickname =              '${manualTeam.nickname}',
          Name =                  '${team.name.replace("'", "''")}',
          TotalPointsAgainst =    ${team.regularSeasonPointsAgainst},
          TotalPoints =           ${team.regularSeasonPointsFor},
          StreakType =            '${manualTeam.record.overall.streakType}',
          StreakLength =          ${manualTeam.record.overall.streakLength},
          Ties =                  ${team.ties},
          Wins =                  ${team.wins},
          Losses =                ${team.losses},
          WinningPercentage =     ${team.winningPercentage},
          Acquisitions =          ${manualTeam.transactionCounter.acquisitions},
          Drops =                 ${manualTeam.transactionCounter.drops},
          MoveToActive =          ${manualTeam.transactionCounter.moveToActive},
          Trades =                ${manualTeam.transactionCounter.trades},
          WaiverRank =            ${manualTeam.waiverRank},
          ProjectedRank =         ${manualTeam.currentProjectedRank},
          DraftDayProjectedRank = ${manualTeam.draftDayProjectedRank},
          ScoringPeriodId =       ${league.scoringPeriodId - 1},
          ScoreAtWeek =           ${teamScoreAtWeek}
      where Id = ${team.id} and ScoringPeriodId = ${league.scoringPeriodId - 1}
        `;
  }

  await runQuery(query);
}

init();
