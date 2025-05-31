import { ExceptionMessage } from "../exceptions/ExceptionMessage.js";
import { BadRequestError } from "../exceptions/exceptions.js";
import * as userRepository from "../repositories/user.repository.js";
import * as challengeRepository from "../repositories/challenge.repository.js"

// 유저 정보 조회
export const getMyInfo = async (userId) => {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    const error = new Error("유저를 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }
  return user;
};

// 유저 챌린지 조회 - 참여중/완료한
export const getMyChallenges = async (query, userId) => {
  const { pageSize, cursor, category, docType, keyword, status } = query;
  const statusList = status
    ? Array.isArray(status)
      ? status
      : status.split(",")
    : null;

  return await userRepository.findMyChallenges(
    {
      pageSize,
      cursor,
      category,
      docType,
      keyword,
      statusList,
    },
    userId
  );
};
