import {UserDocument} from "../types.js";

export const resetUser = async (user: UserDocument) => {
  user.state = {step: null, payload: {}};
  await user.save();
};
