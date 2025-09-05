// /Users/goldp1/Polka/packages/mobile/app/services/apiHelpers.ts

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const handleApiResponse = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    const message = data.detail || `HTTP error! status: ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data;
};
