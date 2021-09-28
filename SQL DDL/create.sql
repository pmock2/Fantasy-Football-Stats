-- auto-generated definition
create database Fantasy collate SQL_Latin1_General_CP1_CI_AS
go

grant connect on database :: Fantasy to dbo
go

grant view any column encryption key definition, view any column master key definition on database :: Fantasy to [public]
go

-- auto-generated definition
create table Team
(
    Id                    int                              not null,
    Abbrev                nvarchar(50),
    Location              nvarchar(50),
    Nickname              nvarchar(50),
    TotalPoints           bigint
        constraint DF_Team_TotalPoints default 0           not null,
    StreakType            nchar(10),
    StreakLength          int,
    Ties                  int
        constraint DF_Team_Ties default 0                  not null,
    Wins                  int
        constraint DF_Team_Wins default 0                  not null,
    Losses                int
        constraint DF_Team_Losses default 0                not null,
    Acquisitions          int
        constraint DF_Team_Acquisitions default 0          not null,
    Drops                 int
        constraint DF_Team_Drops default 0                 not null,
    MoveToActive          int
        constraint DF_Team_MoveToActive default 0          not null,
    Trades                int
        constraint DF_Team_Trades default 0                not null,
    WaiverRank            int
        constraint DF_Team_WaiverRank default 0            not null,
    ProjectedRank         int
        constraint DF_Team_ProjectedRank default 0         not null,
    DraftDayProjectedRank int
        constraint DF_Team_DraftDayProjectedRank default 0 not null,
    TotalPointsAgainst    int default 0,
    Name                  nvarchar(50),
    WinningPercentage     float,
    ScoringPeriodId       int default 1                    not null,
    ScoreAtWeek           int default 0                    not null
)
go

-- auto-generated definition
create table Player
(
    Id                 int not null
        constraint PK_Player
            primary key
        constraint FK_Player_Player
            references Player,
    OnTeamId           int not null,
    AvailabilityStatus nvarchar(50),
    DefaultPosition    nvarchar(50),
    FirstName          nvarchar(50),
    LastName           nvarchar(50),
    FullName           nvarchar(max),
    InjuryStatus       nvarchar(50),
    IsInjured          bit,
    ProTeam            nvarchar(50),
    Status             nvarchar(50),
    PercentStarted     float,
    PercentOwned       float,
    PercentChange      float
)
go

-- auto-generated definition
create table PlayerStat
(
    PlayerId                          int           not null
        constraint FK_PlayerStat_Player
            references Player,
    PassingYards                      float,
    PassingTouchdown                  float,
    Passing2PtConversion              float,
    PassingInterceptions              float,
    RushingYards                      float,
    RushingTouchdowns                 float,
    Rushing2PtConversions             float,
    ReceivingYards                    float,
    ReceivingTouchdowns               float,
    Receiving2PtConversions           float,
    RecevingReceptions                float,
    LostFumbles                       float,
    MadeFieldGoalsFrom50Plus          float,
    MadeFieldGoalsFrom40To49          float,
    MadeFieldGoalsFromUnder40         float,
    MissedFieldGoals                  float,
    MadeExtraPoints                   float,
    MissedExtraPoints                 float,
    Defensive0PointsAllowed           float,
    Defensive1To6PointsAllowed        float,
    Defensive7To13PointsAllowed       float,
    Defensive14To17PointsAllowed      float,
    Defensive28To34PointsAllowed      float,
    Defensive35To45PointsAllowed      float,
    DefensiveBlockedKickForTouchdowns float,
    DefensiveInterceptions            float,
    DefensiveFumbles                  float,
    DefensiveBlockedKicks             float,
    DefensiveSafeties                 float,
    DefensiveSacks                    float,
    KickoffReturnTouchdown            float,
    PuntReturnTouchdown               float,
    FumbleReturnTouchdown             float,
    InterceptionReturnTouchdown       float,
    Defensive100To199YardsAllowed     float,
    Defensive200To299YardsAllowed     float,
    Defensive350To399YardsAllowed     float,
    Defensive400To449YardsAllowed     float,
    Defensive450To499YardsAllowed     float,
    Defensive500To549YardsAllowed     float,
    DefensiveOver550YardsAllowed      float,
    Id                                int identity,
    ScoringPeriodID                   int default 1 not null,
    Position                          nvarchar(50),
    PointsAtWeek                      int default 0
)
go

