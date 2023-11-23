import { Request, Response } from "express";

export default async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ message: "Hello World" });
};
