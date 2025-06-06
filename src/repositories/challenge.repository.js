import prisma from "../prisma/client.prisma.js";
import { getInitial } from "../utils/initial.utils.js";

/**
 * 챌린지 등록 및 자동 신청
 */
async function save(challenge, userId) {
  return await prisma.$transaction(async (tx) => {
    const createdChallenge = await tx.challenge.create({
      data: {
        authorId: userId,
        title: challenge.title,
        description: challenge.description,
        category: challenge.category,
        docType: challenge.docType,
        originalUrl: challenge.originalUrl,
        deadline: challenge.deadline,
        maxParticipant: challenge.maxParticipant,
      },
    });

    const createdApplication = await tx.application.create({
      data: {
        authorId: userId,
        challengeId: createdChallenge.id,
        appliedAt: new Date(),
      },
    });

    return { createdChallenge, createdApplication };
  });
}

// 승인된 챌린지 전체 조회 (추후 사용 예정)
const findAllChallenges = async () => {
  return await prisma.challenge.findMany({
    where: {
      application: {
        adminStatus: "ACCEPTED",
      },
    },
    include: {
      participants: true,
    },
  });
};

// 특정 challenge 조회 (상세 조회에 활용)
const findChallengeDetailById = async (challengeId) => {
  return await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
        },
      },
      participants: true,
    },
  });
};
// 특정 challenge 조회  (수정, 삭제에 활용)
const findChallengeById = async (challengeId) => {
  return await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, authorId: true, title: true, isClosed: true },
  });
};

// 사용자 역할 조회
const findUserRoleById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
};

// challenge update
const updateChallenge = async (challengeId, updateData) => {
  return await prisma.challenge.update({
    where: { id: challengeId },
    data: updateData,
  });
};

// 관리자 - 신청 상태 업데이트
const updateApplication = async (challengeId, updateData) => {
  const data = { ...updateData };

  if (["REJECTED", "DELETED"].includes(updateData.adminStatus)) {
    data.invalidatedAt = new Date();
  }

  return await prisma.application.update({
    where: { challengeId },
    data,
  });
};

const deleteChallengeById = async (challengeId) => {
  await prisma.application.deleteMany({
    where: {
      challengeId: challengeId, // 해당 챌린지를 참조하는 모든 신청 삭제
    },
  });

  await prisma.challenge.delete({
    where: { id: challengeId },
  });
};

//챌린지 목록 가져오기
async function getChallenges(options, userId) {
  const {
    page = 1,
    pageSize = 10,
    category,
    docType,
    keyword,
    status,
  } = options;

  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const where = {};

  if (category) {
    if (Array.isArray(category)) {
      where.category = {
        in: category,
      };
    } else {
      where.category = category;
    }
  }

  if (docType) {
    where.docType = docType;
  }

  //데이터의 총 갯수(챌린지 상태는 제외되어있음)
  let allChallenges = await prisma.challenge.findMany({
    where: {
      ...where,
      application: {
        adminStatus: "ACCEPTED",
      },
    },
    include: {
      participants: true,
      application: {
        select: {
          adminStatus: true,
          appliedAt: true,
        },
      },
      works: {
        where: {
          authorId: userId,
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (keyword) {
    allChallenges = allChallenges.filter((challenge) => {
      const title = challenge.title || "";
      const desc = challenge.description || "";

      const normalizedTitle = title.replace(/\s/g, "").toLowerCase();
      const normalizedDesc = desc.replace(/\s/g, "").toLowerCase();

      const titleChosung = getInitial(normalizedTitle);
      const descChosung = getInitial(normalizedDesc);

      const keywordNoSpace = keyword.replace(/\s/g, "").toLowerCase(); //키워드 띄어쓰기 제거거+소문자로
      const isChosungSearch = /^[ㄱ-ㅎ]+$/.test(keywordNoSpace); // 초성만 입력된건지 확인 T/F

      if (isChosungSearch) {
        // 사용자가 초성만 입력했을 경우
        return (
          titleChosung.includes(keywordNoSpace) ||
          descChosung.includes(keywordNoSpace)
        );
      }

      const keywordInitial = getInitial(keywordNoSpace);

      return (
        titleChosung.includes(keywordInitial) ||
        descChosung.includes(keywordInitial)
      );
    });
  }

  // status(챌린지의 진행 중, 마감 상태)를 포함하여 필터링
  const challengesWithStatus = allChallenges.map((challenge) => {
    const status =
      challenge.participants.length >= challenge.maxParticipant ||
      new Date(challenge.deadline) <= new Date()
        ? "closed"
        : "open";

    return {
      ...challenge,
      status,
    };
  });

  //최종적인 챌린지 데이터
  const statusFilterdChallenges = status
    ? challengesWithStatus.filter((c) => c.status === status)
    : challengesWithStatus;

  //모든 챌린지 데이터에서 페이지네이션으로 자르기
  const pagedChallenges = statusFilterdChallenges.slice(skip, skip + take);

  return {
    totalCount: statusFilterdChallenges.length,
    currentPage: Number(page),
    pageSize: Number(pageSize),
    data: pagedChallenges,
  };
}

// 챌린지 신청 목록 조회
async function findAllApplications(options) {
  const { skip, take, where, orderBy } = options;

  const [totalCount, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        challenge: {
          include: { participants: true },
        },
      },
    }),
  ]);

  return {
    totalCount,
    data: applications,
  };
}

// 챌린지 신청 상세 조회
export const findApplicationById = async (applicationId) => {
  const current = await prisma.application.findUnique({
    where: {
      id: applicationId,
    },
    include: {
      challenge: {
        include: {
          participants: true,
        },
      },
    },
  });

  if (!current) return null;

  // 이전 신청 챌린지 id 찾기
  const prev = await prisma.application.findFirst({
    where: { id: { lt: applicationId } },
    orderBy: { id: "desc" },
    select: { id: true },
  });

  // 다음 신청 챌린지 id 찾기
  const next = await prisma.application.findFirst({
    where: { id: { gt: applicationId } },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  return {
    application: current,
    prevApplicationId: prev?.id || null,
    nextApplicationId: next?.id || null,
  };
};

// 데드라인 넘은 첼린지 찾기
async function findExpiredChallenges(currentTime) {
  return prisma.challenge.findMany({
    where: {
      isClosed: false,
      deadline: { lte: currentTime },
    },
    include: {
      participants: true, // 참여자 정보 포함
    },
  });
}

async function closeChallenge(challengeId) {
  return prisma.challenge.update({
    where: { id: challengeId },
    data: { isClosed: true },
  });
}

export default {
  save,
  getChallenges,
  findAllChallenges,
  findAllApplications,
  findUserRoleById,
  findChallengeById,
  updateChallenge,
  updateApplication,
  deleteChallengeById,
  findChallengeDetailById,
  findApplicationById,
  findExpiredChallenges,
  closeChallenge,
};
