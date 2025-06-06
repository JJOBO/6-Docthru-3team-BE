import prisma from "../prisma/client.prisma.js";

// 목록 조회
async function findByWorkId(workId) {
  return prisma.feedback.findMany({
    where: { workId: Number(workId) },
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorId: true,
      user: { select: { nickname: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// 단일 피드백 조회 (작성자 확인용)
async function findById(feedbackId) {
  return prisma.feedback.findUnique({
    where: { id: Number(feedbackId) },
    include: {
      work: {
        include: {
          challenge: {
            select: {
              isClosed: true,
            },
          },
        },
      },
    },
  });
}

// 등록
async function create(workId, authorId, content) {
  return prisma.feedback.create({
    data: { workId: Number(workId), authorId, content },
    include: {
      work: {
        include: {
          challenge: {
            select: {
              isClosed: true,
            },
          },
        },
      },
    },
  });
}

// 수정
async function update(feedbackId, content) {
  return prisma.feedback.update({
    where: { id: Number(feedbackId) },
    data: { content },
  });
}

// 삭제
async function remove(feedbackId) {
  return prisma.feedback.delete({
    where: { id: Number(feedbackId) },
  });
}

export default { findByWorkId, findById, create, update, remove };
