import { CsrfMiddleware } from './csrf.middleware';

function makeResponse() {
  const response: any = {
    locals: {},
    cookie: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe('CsrfMiddleware', () => {
  it('permite resposta pública de CSAT sem cookie CSRF', () => {
    const middleware = new CsrfMiddleware();
    const request: any = {
      method: 'POST',
      originalUrl: '/csat/survey/token-123/answer',
      url: '/csat/survey/token-123/answer',
      cookies: {},
      headers: {},
    };
    const response = makeResponse();
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('permite webhooks públicos com autenticação própria sem cookie CSRF', () => {
    const middleware = new CsrfMiddleware();
    const response = makeResponse();
    const next = jest.fn();

    middleware.use(
      {
        method: 'POST',
        originalUrl: '/webhooks/chat/incoming',
        url: '/webhooks/chat/incoming',
        cookies: {},
        headers: {},
      } as any,
      response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('continua bloqueando POST comum sem token CSRF', () => {
    const middleware = new CsrfMiddleware();
    const request: any = {
      method: 'POST',
      originalUrl: '/service-orders',
      url: '/service-orders',
      cookies: {},
      headers: {},
    };
    const response = makeResponse();
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
  });
});
