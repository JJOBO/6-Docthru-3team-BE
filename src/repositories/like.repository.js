import prisma from "../prisma/client.prisma.js";

const isWorkLikedByUser = async (workId, userId) => {
  const like = await prisma.like.findFirst({
    where: {
      workId,
      userId,
    },
  });

  return !!like; // true 또는 false 반환
};

const createLike = async (workId, userId) => {
  const like = await prisma.like.create({
    data: {
      workId,
      userId,
    },
  });

  return like;
};

const deleteLike = async (workId, userId) => {
  const deletedLike = await prisma.like.delete({
    where: {
      userId_workId: { userId, workId },
    },
  });

  return deletedLike;
};

export default {
  isWorkLikedByUser,
  createLike,
  deleteLike,
};
