import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestPinLoginDto } from './dto/request-pin-login.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { ChangePinDto } from './dto/change-pin.dto';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Email OTP (Admin, Employee, EMAIL_OTP Drivers) ─────────────────────────

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to company email (Admin / Employee / EMAIL_OTP Driver)' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.email);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email OTP and return JWT tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  // ─── Mobile PIN (MOBILE_PIN Drivers only) ────────────────────────────────────

  @Post('driver/request-pin-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate mobile number is registered for PIN login (Driver)' })
  requestPinLogin(@Body() dto: RequestPinLoginDto) {
    return this.authService.requestPinLogin(dto.mobileNumber);
  }

  @Post('driver/verify-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify driver PIN and return JWT tokens' })
  verifyPin(@Body() dto: VerifyPinDto) {
    return this.authService.verifyPin(dto.mobileNumber, dto.pin);
  }

  @Post('driver/change-pin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Forced PIN change — required after admin set/reset (Driver)' })
  changePin(@Request() req: { user: { id: string } }, @Body() dto: ChangePinDto) {
    return this.authService.changePin(req.user.id, dto.currentPin, dto.newPin);
  }

  // ─── Token management ────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke current session' })
  logout(@Body('refreshToken') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }
}
